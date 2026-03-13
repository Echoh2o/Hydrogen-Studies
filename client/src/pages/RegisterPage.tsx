/**
 * Registration Page Component
 * Split-layout with value proposition and streamlined registration form
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  UserPlus,
  User,
  Mail,
  Lock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  Droplets,
  BookOpen,
  Heart,
  Search,
  TrendingUp,
  Sparkles,
  Star,
} from "lucide-react";
import { Helmet } from "react-helmet";
import Footer from "@/components/layout/Footer";

// Password strength calculation
function calculatePasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 25;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
  if (/\d/.test(password)) strength += 12.5;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 12.5;
  return strength;
}

function getPasswordStrengthLabel(strength: number): {
  label: string;
  color: string;
} {
  if (strength >= 75) return { label: "Strong", color: "text-green-600" };
  if (strength >= 50) return { label: "Medium", color: "text-yellow-600" };
  if (strength >= 25) return { label: "Weak", color: "text-orange-600" };
  return { label: "Very Weak", color: "text-red-600" };
}

// Form validation schema
const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username must be less than 50 characters")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, hyphens and underscores",
      ),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password must be less than 100 characters"),
    confirmPassword: z.string(),
    acceptTerms: z
      .boolean()
      .refine(
        (val) => val === true,
        "You must accept the terms and conditions",
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const BENEFITS = [
  {
    icon: BookOpen,
    title: "Full Research Library",
    description: "Browse 700+ peer-reviewed studies on hydrogen therapy, written in plain language",
  },
  {
    icon: Heart,
    title: "Personalized Dashboard",
    description: "Save studies, track reading history, and set your health interest areas",
  },
  {
    icon: Search,
    title: "Smart Search",
    description: "Search by health condition, body system, or keyword to find what matters to you",
  },
  {
    icon: TrendingUp,
    title: "Stay Current",
    description: "Get notified when new hydrogen research is published in your areas of interest",
  },
  {
    icon: Sparkles,
    title: "Research Blog",
    description: "AI-curated articles that break down complex studies into actionable insights",
  },
  {
    icon: Star,
    title: "Exclusive Content",
    description: "Member-only study summaries, health guides, and educational resources",
  },
];

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [registerError, setRegisterError] = useState<string>("");
  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false);

  // Form setup
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  // Watch password field for strength calculation
  const password = form.watch("password");
  const passwordStrength = calculatePasswordStrength(password || "");
  const passwordStrengthInfo = getPasswordStrengthLabel(passwordStrength);

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json() as Promise<{ isFirstAdmin?: boolean; message?: string }>;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/check-session"] });

      if (response.isFirstAdmin) {
        toast({
          title: "Admin account created!",
          description:
            "You are the first user and have been granted admin privileges.",
        });
      } else {
        toast({
          title: "Welcome to Hydrogen Studies!",
          description: "Your free account is ready. Start exploring the research.",
        });
      }

      navigate("/my-dashboard");
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.error || error.message || "Registration failed";
      setRegisterError(errorMessage);

      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    setRegisterError("");
    registerMutation.mutate(data);
  };

  return (
    <>
    <Helmet>
      <title>Create Account - Hydrogen Studies</title>
      <meta name="description" content="Create a free Hydrogen Studies account to save studies, track research progress, and get personalized recommendations." />
    </Helmet>
    <div className="min-h-screen flex">
      {/* Left Panel — Value Proposition (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-20 w-80 h-80 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-10 left-10 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 mb-12">
            <Droplets className="h-10 w-10" />
            <span className="text-2xl font-bold">Hydrogen Studies</span>
          </Link>

          <h1 className="text-4xl font-bold mb-3 leading-tight">
            Science You Can
            <br />
            Actually Understand
          </h1>
          <p className="text-teal-100 text-lg mb-10 max-w-md">
            Join thousands who use Hydrogen Studies to understand the real research
            behind molecular hydrogen — no PhD required.
          </p>

          <div className="grid grid-cols-1 gap-4">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-3">
                <div className="bg-white/15 rounded-lg p-2 shrink-0">
                  <benefit.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{benefit.title}</h3>
                  <p className="text-teal-100 text-xs mt-0.5 leading-relaxed">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-8">
          <div className="flex items-center gap-3 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <Shield className="h-8 w-8 text-teal-200 shrink-0" />
            <div>
              <p className="text-sm font-medium">100% Free for Echo Water Customers</p>
              <p className="text-xs text-teal-200">
                Your Echo Water purchase includes full access — no credit card needed
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <Droplets className="h-8 w-8 text-teal-600" />
            <span className="text-xl font-bold">Hydrogen Studies</span>
          </div>

          <Card className="shadow-xl border-0 bg-white dark:bg-gray-800">
            <CardContent className="pt-8 pb-4 px-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Create Your Free Account</h2>
                <p className="text-muted-foreground mt-1">
                  Get instant access to 700+ hydrogen research studies
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {registerError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{registerError}</AlertDescription>
                    </Alert>
                  )}

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="text"
                              placeholder="Choose a username"
                              className="pl-10 h-11"
                              autoComplete="username"
                              data-testid="input-username"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="Enter your email"
                              className="pl-10 h-11"
                              autoComplete="email"
                              data-testid="input-email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="Create a strong password"
                              className="pl-10 h-11"
                              autoComplete="new-password"
                              onFocus={() => setShowPasswordRequirements(true)}
                              data-testid="input-password"
                            />
                          </div>
                        </FormControl>
                        {password && (
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2">
                              <Progress value={passwordStrength} className="h-1.5" />
                              <span
                                className={`text-xs font-medium ${passwordStrengthInfo.color}`}
                              >
                                {passwordStrengthInfo.label}
                              </span>
                            </div>
                            {showPasswordRequirements && (
                              <div className="text-xs space-y-1">
                                <PasswordReq met={password.length >= 6}>At least 6 characters</PasswordReq>
                                <PasswordReq met={/[A-Z]/.test(password) && /[a-z]/.test(password)}>Upper & lowercase letters</PasswordReq>
                                <PasswordReq met={/\d/.test(password)}>At least one number</PasswordReq>
                                <PasswordReq met={/[!@#$%^&*(),.?":{}|<>]/.test(password)}>At least one special character</PasswordReq>
                              </div>
                            )}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Shield className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="Re-enter your password"
                              className="pl-10 h-11"
                              autoComplete="new-password"
                              data-testid="input-confirm-password"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="acceptTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-accept-terms"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            I accept the{" "}
                            <Link
                              href="/terms"
                              className="text-teal-600 hover:underline"
                            >
                              Terms of Service
                            </Link>{" "}
                            and{" "}
                            <Link
                              href="/privacy"
                              className="text-teal-600 hover:underline"
                            >
                              Privacy Policy
                            </Link>
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <button
                    type="submit"
                    className="btn-primary btn-full btn-icon-left"
                    disabled={registerMutation.isPending}
                    data-testid="button-register"
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating your account...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Free Account
                      </>
                    )}
                  </button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3 pb-8 px-8">
              <div className="text-sm text-center text-gray-600 dark:text-gray-400">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-teal-600 font-semibold hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </Card>

          {/* Mobile value proposition */}
          <div className="lg:hidden mt-6 space-y-3">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">What you get — completely free</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {BENEFITS.slice(0, 4).map((benefit) => (
                <div key={benefit.title} className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border">
                  <CheckCircle2 className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                  <span className="text-xs font-medium">{benefit.title}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <span>Free for Echo Water customers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}

/** Small helper component for password requirements */
function PasswordReq({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      {met ? (
        <CheckCircle2 className="h-3 w-3 text-green-600" />
      ) : (
        <XCircle className="h-3 w-3 text-gray-400" />
      )}
      <span className={met ? "text-green-600" : "text-gray-500"}>
        {children}
      </span>
    </div>
  );
}
