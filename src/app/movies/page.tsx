"use client";

import { Suspense } from "react";
import { useData } from "@/lib/DataProvider";
import { MoviesGridClient } from "@/components/movies/MoviesGridClient";
import { LoadingState } from "@/components/states/LoadingState";

export default function MoviesPage() {
  const { movies, theaters, screenings } = useData();

  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><LoadingState /></div>}>
      <MoviesGridClient movies={movies} theaters={theaters} screenings={screenings} />
    </Suspense>
  );
}
