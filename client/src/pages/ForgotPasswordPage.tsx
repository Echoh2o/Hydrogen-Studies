import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import { useLocation } from "wouter";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Forgot Password - Hydrogen Studies";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh] flex items-center justify-center bg-gray-50 px-4 py-16">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 space-y-6">
            {submitted ? (
              <div className="text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <h1 className="text-2xl font-bold text-gray-900">Check Your Email</h1>
                <p className="text-gray-600">
                  If an account with that email exists, we've sent a password reset link.
                  Please check your inbox and spam folder.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/login")}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <Mail className="h-10 w-10 text-teal-600 mx-auto mb-3" />
                  <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
                  <p className="text-gray-600 mt-2">
                    Enter your email and we'll send you a reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoFocus
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
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>

                <div className="text-center">
                  <button
                    onClick={() => setLocation("/login")}
                    className="text-sm text-teal-600 hover:underline"
                  >
                    Back to Login
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
