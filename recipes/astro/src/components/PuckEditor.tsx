import { Puck } from "@puckeditor/core";
import puckConfig from "../../puck.config";
import type { PageData } from "../lib/get-page";

type Props = {
  data: PageData;
  path: string;
};

export default function PuckEditor({ data, path }: Props) {
  // Import Puck styles
  if (typeof document !== "undefined") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/_astro/puck.css";
    document.head.appendChild(link);
  }

  const handlePublish = async (newData: PageData) => {
    // Save to the server endpoint
    const response = await fetch("/api/puck/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path, data: newData }),
    });

    if (response.ok) {
      // Redirect to the edited page
      window.location.href = path || "/";
    } else {
      alert("Failed to save page");
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Puck
        config={puckConfig}
        data={data}
        onPublish={handlePublish}
        headerPath={path}
      />
    </div>
  );
}
