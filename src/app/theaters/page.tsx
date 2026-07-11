"use client";

import { useData } from "@/lib/DataProvider";
import { TheatersGridClient } from "@/components/theaters/TheatersGridClient";

export default function TheatersPage() {
  const { theaters } = useData();
  return <TheatersGridClient theaters={theaters} />;
}
