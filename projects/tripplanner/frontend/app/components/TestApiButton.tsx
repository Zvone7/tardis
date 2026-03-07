"use client"

import { useState } from "react"
import { Button } from "../components/ui/button"
import { toast } from "../components/ui/use-toast"
import { homeApi } from "../utils/apiClient"

export function TestApiButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setApiResponse(null);
    
    try {
      const data = await homeApi.getStatus();
      console.log("------- Response from API -------");
      console.log(data);
      console.log("--------------------------------");
      
      // Update state instead of DOM manipulation
      setApiResponse(data);
      
      toast({
        title: "API Test Successful",
        description: "API request was successful",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "API Test Failed",
        description: "There was an error communicating with the API."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Button 
        onClick={handleClick} 
        disabled={isLoading}
        className="mt-4"
      >
        {isLoading ? "Testing..." : "Test API"}
      </Button>
      
      {apiResponse && (
        <div className="mt-4 p-4 bg-gray-100 rounded-md w-full max-w-lg overflow-auto">
          <pre className="whitespace-pre-wrap text-sm">{apiResponse}</pre>
        </div>
      )}
    </div>
  );
}
