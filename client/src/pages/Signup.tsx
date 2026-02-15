import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function Signup() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signup() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }

      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-[420px]">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="First name" onChange={e => setForm({ ...form, firstName: e.target.value })} />
          <Input placeholder="Last name" onChange={e => setForm({ ...form, lastName: e.target.value })} />
          <Input placeholder="Email" onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input type="password" placeholder="Password" onChange={e => setForm({ ...form, password: e.target.value })} />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button className="w-full" onClick={signup} disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
