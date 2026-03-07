"use client"

import { useState } from "react"
import { Button } from "../../components/ui/button"

export function LoginButton() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_ROOT_URL;
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setIsLoading(true);
    const form = document.createElement("form");
    form.method = "GET";
    form.action = `${backendUrl}/api/Account/Login`;
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <Button
      onClick={handleLogin}
      disabled={isLoading}
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
    >
      {isLoading ? "Connecting..." : "Login with Google"}
    </Button>
  );
}
