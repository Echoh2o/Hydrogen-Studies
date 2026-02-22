import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, CheckCircle } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import { useLocation, useSearch } from "wouter";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Reset Password - Hydrogen Studies";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <SiteHeader />
        <main className="min-h-[70vh] flex items-center justify-center bg-gray-50 px-4 py-16">
          <Card className="w-full max-w-md">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Invalid Link</h1>
              <p className="text-gray-600">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Button
                onClick={() => setLocation("/forgot-password")}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Request New Link
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh] flex items-center justify-center bg-gray-50 px-4 py-16">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 space-y-6">
            {success ? (
              <div className="text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <h1 className="text-2xl font-bold text-gray-900">Password Reset</h1>
                <p className="text-gray-600">
                  Your password has been successfully reset.
                </p>
                <Button
                  onClick={() => setLocation("/login")}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Log In
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <Lock className="h-10 w-10 text-teal-600 mx-auto mb-3" />
                  <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
                  <p className="text-gray-600 mt-2">Enter your new password below.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      minLength={6}
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      required
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                    disabled={loading}
                  >
                    {loading ? "Resetting..." : "Reset Password"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
