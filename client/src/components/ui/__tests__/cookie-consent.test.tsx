import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, fireEvent, cleanup } from "@testing-library/react";
import CookieConsent from "../cookie-consent";
import { CONSENT_KEY, OPEN_PRIVACY_CHOICES_EVENT } from "@/lib/consent";

function mockGeo(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function setGpc(value: boolean | undefined) {
  Object.defineProperty(window.navigator, "globalPrivacyControl", { value, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  setGpc(undefined);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CookieConsent banner visibility", () => {
  it("shows the banner in a consent-required region", async () => {
    const fetchMock = mockGeo({ country: "DE", consentRequired: true });
    render(<CookieConsent />);
    expect(await screen.findByRole("region", { name: "Cookie consent" })).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/geo", expect.objectContaining({ cache: "no-store" }));
  });

  it("no banner outside consent-required regions", async () => {
    const fetchMock = mockGeo({ country: "US", consentRequired: false });
    render(<CookieConsent />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });

  it("no banner when the geo lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<CookieConsent />);
    await act(async () => {});
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });

  it("no banner and no geo request once a choice is stored", async () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    const fetchMock = mockGeo({ consentRequired: true });
    render(<CookieConsent />);
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });

  it("no banner with Global Privacy Control", async () => {
    setGpc(true);
    const fetchMock = mockGeo({ consentRequired: true });
    render(<CookieConsent />);
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });

  it("?__geo=DE forces the banner on for verification", async () => {
    window.history.replaceState(null, "", "/?__geo=DE");
    mockGeo({ country: "US", consentRequired: false });
    render(<CookieConsent />);
    expect(await screen.findByRole("region", { name: "Cookie consent" })).not.toBeNull();
  });

  it("Accept and Reject store the choice and hide the banner", async () => {
    mockGeo({ consentRequired: true });
    render(<CookieConsent />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(localStorage.getItem(CONSENT_KEY)).toBe("declined");
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });
});

describe("Privacy choices panel", () => {
  it("opens from the footer event outside consent regions, analytics on by default", async () => {
    mockGeo({ consentRequired: false });
    render(<CookieConsent />);
    await act(async () => {});
    act(() => {
      window.dispatchEvent(new Event(OPEN_PRIVACY_CHOICES_EVENT));
    });
    expect(screen.getByRole("dialog", { name: "Privacy choices" })).not.toBeNull();
    const analytics = screen.getByRole("checkbox", { name: /Analytics/ }) as HTMLInputElement;
    expect(analytics.checked).toBe(true);

    fireEvent.click(analytics);
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));
    expect(localStorage.getItem(CONSENT_KEY)).toBe("declined");
  });

  it("does not pre-tick analytics from the banner's Settings in consent regions", async () => {
    mockGeo({ consentRequired: true });
    render(<CookieConsent />);
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    const analytics = screen.getByRole("checkbox", { name: /Analytics/ }) as HTMLInputElement;
    expect(analytics.checked).toBe(false);
  });

  it("GPC: analytics toggle is off and locked", async () => {
    setGpc(true);
    mockGeo({ consentRequired: false });
    render(<CookieConsent />);
    act(() => {
      window.dispatchEvent(new Event(OPEN_PRIVACY_CHOICES_EVENT));
    });
    const analytics = screen.getByRole("checkbox", { name: /Analytics/ }) as HTMLInputElement;
    expect(analytics.checked).toBe(false);
    expect(analytics.disabled).toBe(true);
    expect(screen.getByText(/Global Privacy Control/)).not.toBeNull();
  });
});
