import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm mx-auto">
        <h1 className="mb-4 text-6xl font-bold text-primary">404</h1>
        <p className="mb-2 text-xl font-semibold text-foreground">Page not found</p>
        <p className="mb-6 text-muted-foreground text-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate('/dashboard')} className="w-full">
            <Home className="w-4 h-4 mr-2" />
            Go to Home
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
