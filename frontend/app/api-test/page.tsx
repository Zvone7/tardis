// /app/api-test/page.tsx
"use client";

import { useEffect, useState } from "react";
import { homeApi } from "../utils/apiClient";

const ApiTestPage = () => {
  const [data, setData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await homeApi.getStatus();
        setData(result);
      } catch (error: any) {
        console.log("fail:"+error);
        setError(error.message);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <h1>API Test Page</h1>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      <p>Data from API: {data}</p>
    </div>
  );
};

export default ApiTestPage;
