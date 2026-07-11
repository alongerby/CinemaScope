"use client";

import { notFound, useParams } from "next/navigation";
import { useData } from "@/lib/DataProvider";
import { TheaterDetailClient } from "@/components/theaters/TheaterDetailClient";

export default function TheaterDetailPage() {
  const params = useParams<{ id: string }>();
  const { movies, theaters, screenings } = useData();

  const theater = theaters.find((t) => t.id === params.id);
  if (!theater) notFound();

  return <TheaterDetailClient theater={theater} screenings={screenings.filter((s) => s.theaterId === theater.id)} movies={movies} />;
}
