"use client";

import { notFound, useParams } from "next/navigation";
import { useData } from "@/lib/DataProvider";
import { MovieDetailClient } from "@/components/movies/MovieDetailClient";

export default function MovieDetailPage() {
  const params = useParams<{ id: string }>();
  const { movies, theaters, screenings } = useData();

  const movie = movies.find((m) => m.id === params.id);
  if (!movie) notFound();

  return <MovieDetailClient movie={movie} screenings={screenings.filter((s) => s.movieId === movie.id)} theaters={theaters} />;
}
