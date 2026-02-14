import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  async function login() {
    const response = await fetch("/api/login", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-[360px]">
        <CardHeader>
          <CardTitle>Demo Login</CardTitle>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={login}>
            Login as Demo User
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
