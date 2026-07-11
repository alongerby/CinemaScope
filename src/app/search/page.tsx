"use client";

import { Suspense } from "react";
import { useData } from "@/lib/DataProvider";
import { SearchPageClient } from "@/components/search/SearchPageClient";
import { LoadingState } from "@/components/states/LoadingState";

export default function SearchPage() {
  const { movies, theaters, screenings } = useData();

  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><LoadingState /></div>}>
      <SearchPageClient movies={movies} theaters={theaters} screenings={screenings} />
    </Suspense>
  );
}
