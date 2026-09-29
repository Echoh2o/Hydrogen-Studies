import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { useScrollToHash } from "../use-scroll-to-hash";

function Probe({ ready }: { ready: boolean }) {
  useScrollToHash(ready);
  return ready ? <h2 id="is-hydrogen-flammable">Is hydrogen flammable?</h2> : null;
}

describe("useScrollToHash", () => {
  let scrolled: string[];
  beforeEach(() => {
    scrolled = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this.id);
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("scrolls to the hash target once the content is ready", () => {
    window.history.replaceState(null, "", "/blog/x#is-hydrogen-flammable");
    const { rerender } = render(<Probe ready={false} />);
    expect(scrolled).toEqual([]);
    rerender(<Probe ready={true} />);
    expect(scrolled).toEqual(["is-hydrogen-flammable"]);
  });

  it("does nothing without a hash or when the target is missing", () => {
    window.history.replaceState(null, "", "/blog/x");
    render(<Probe ready={true} />);
    window.history.replaceState(null, "", "/blog/x#not-on-page");
    render(<Probe ready={true} />);
    expect(scrolled).toEqual([]);
  });
});
