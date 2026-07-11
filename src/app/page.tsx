"use client";

import { useMemo } from "react";
import { useData } from "@/lib/DataProvider";
import { HomeClient } from "@/components/home/HomeClient";

export default function HomePage() {
  const { movies, theaters } = useData();

  // Prefer movies with a real poster image in the hero strip, then by popularity.
  const marqueeMovies = useMemo(
    () =>
      [...movies]
        .sort((a, b) => {
          const posterRank = Number(Boolean(b.posterUrl)) - Number(Boolean(a.posterUrl));
          if (posterRank !== 0) return posterRank;
          return b.popularityScore - a.popularityScore;
        })
        .slice(0, 12),
    [movies],
  );

  return <HomeClient movieCount={movies.length} theaterCount={theaters.length} marqueeMovies={marqueeMovies} />;
}
