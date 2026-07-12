"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Movie } from "@/lib/types";
import { MoviePoster } from "@/components/MoviePoster";

const BASE_SPEED = 0.08; // 100 pixels per second
const EDGE_ZONE = 120;
const EDGE_MIN_SPEED = 0.12;
const EDGE_MAX_SPEED = 0.7;
// Mouse gets a small threshold so a plain click doesn't register as a
// micro-drag. Touch needs to commit almost immediately: real phones decide
// "is this a scroll gesture" within the first pixel or two of movement, so
// waiting for 6px before taking over from the browser routinely loses that
// race — the swipe just does nothing, which reads as "the carousel doesn't
// work with a finger."
const DRAG_THRESHOLD = 6;
const TOUCH_DRAG_THRESHOLD = 2;

// Ensures each copy is wider than most screens, even when there are only
// a few movies. This prevents blank space at either end of the carousel.
const MIN_POSTERS_PER_SET = 24;

type CarouselCopy = "prefix" | "middle" | "suffix";

type RepeatedMovie = {
  movie: Movie;
  sourceIndex: number;
  repeatIndex: number;
};

export function PosterCarousel({ movies }: { movies: Movie[] }) {
  const { t } = useLanguage();

  const trackRef = useRef<HTMLDivElement | null>(null);
  const innerTrackRef = useRef<HTMLDivElement | null>(null);

  const prefixSetRef = useRef<HTMLDivElement | null>(null);
  const middleSetRef = useRef<HTMLDivElement | null>(null);
  const suffixSetRef = useRef<HTMLDivElement | null>(null);

  const loopWidthRef = useRef(0);
  const loopStartRef = useRef(0);
  const loopEndRef = useRef(0);
  const initializedRef = useRef(false);

  const draggingRef = useRef(false);
  const potentialDragRef = useRef(false);
  const justDraggedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  const posterHoveredRef = useRef(false);
  const posterFocusedRef = useRef(false);

  const edgeDirectionRef = useRef<-1 | 0 | 1>(0);
  const edgeSpeedRef = useRef(0);

  const autoplayEnabledRef = useRef(true);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);

  const lastFrameTimeRef = useRef(0);
  const animationFrameRef = useRef(0);

  /**
   * Repeat the movie list inside each logical copy.
   *
   * The carousel still has three main copies:
   *
   * [prefix] [middle] [suffix]
   *
   * Repeating movies within each copy makes each logical copy wide enough
   * to cover large screens without exposing empty space.
   */
  const repeatedMovies = useMemo<RepeatedMovie[]>(() => {
    if (movies.length === 0) {
      return [];
    }

    const repeatCount = Math.max(
      1,
      Math.ceil(MIN_POSTERS_PER_SET / movies.length),
    );

    return Array.from({ length: repeatCount }, (_, repeatIndex) =>
      movies.map((movie, sourceIndex) => ({
        movie,
        sourceIndex,
        repeatIndex,
      })),
    ).flat();
  }, [movies]);

  /**
   * Keep the scroll position inside the middle logical copy.
   *
   * Because all three copies are identical, adding or subtracting one
   * copy width is visually invisible.
   */
  const wrapScrollPosition = useCallback(() => {
    const track = trackRef.current;
    const loopWidth = loopWidthRef.current;
    const loopStart = loopStartRef.current;
    const loopEnd = loopEndRef.current;

    if (!track || loopWidth <= 0) {
      return;
    }

    while (track.scrollLeft >= loopEnd) {
      track.scrollLeft -= loopWidth;
    }

    while (track.scrollLeft < loopStart) {
      track.scrollLeft += loopWidth;
    }
  }, []);

  /**
   * Measure the exact distance between identical logical copies and place
   * the initial scroll position at the beginning of the middle copy.
   */
  useLayoutEffect(() => {
    initializedRef.current = false;

    let pendingFrame = 0;

    const measure = () => {
      const track = trackRef.current;
      const prefixSet = prefixSetRef.current;
      const middleSet = middleSetRef.current;
      const suffixSet = suffixSetRef.current;

      if (!track || !prefixSet || !middleSet || !suffixSet) {
        return;
      }

      const prefixStart = prefixSet.offsetLeft;
      const middleStart = middleSet.offsetLeft;
      const suffixStart = suffixSet.offsetLeft;
      const loopWidth = middleStart - prefixStart;

      if (loopWidth <= 0) {
        return;
      }

      loopWidthRef.current = loopWidth;
      loopStartRef.current = middleStart;
      loopEndRef.current = suffixStart;

      if (!initializedRef.current) {
        track.scrollLeft = middleStart;
        initializedRef.current = true;
      } else {
        wrapScrollPosition();
      }
    };

    const requestMeasure = () => {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = requestAnimationFrame(measure);
    };

    requestMeasure();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(requestMeasure)
        : null;

    if (resizeObserver) {
      if (trackRef.current) {
        resizeObserver.observe(trackRef.current);
      }

      if (innerTrackRef.current) {
        resizeObserver.observe(innerTrackRef.current);
      }

      if (prefixSetRef.current) {
        resizeObserver.observe(prefixSetRef.current);
      }

      if (middleSetRef.current) {
        resizeObserver.observe(middleSetRef.current);
      }
    }

    window.addEventListener("resize", requestMeasure);

    return () => {
      cancelAnimationFrame(pendingFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", requestMeasure);
    };
  }, [repeatedMovies.length, wrapScrollPosition]);

  /**
   * Respect reduced-motion preferences by disabling autoplay initially.
   * The visitor can still explicitly start it with the play button.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mediaQuery.matches) {
      autoplayEnabledRef.current = false;
      setAutoplayEnabled(false);
    }

    const handlePreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        autoplayEnabledRef.current = false;
        setAutoplayEnabled(false);
      }
    };

    mediaQuery.addEventListener("change", handlePreferenceChange);

    return () => {
      mediaQuery.removeEventListener("change", handlePreferenceChange);
    };
  }, []);

  /**
   * One animation loop controls both autoplay and edge scrolling.
   *
   * Priority:
   * 1. Dragging
   * 2. Pointer edge scrolling
   * 3. Autoplay
   */
  useEffect(() => {
    let active = true;

    const animate = (currentTime: number) => {
      if (!active) {
        return;
      }

      const track = trackRef.current;

      const deltaTime = lastFrameTimeRef.current
        ? Math.min(currentTime - lastFrameTimeRef.current, 48)
        : 16;

      lastFrameTimeRef.current = currentTime;

      if (
        track &&
        initializedRef.current &&
        loopWidthRef.current > 0 &&
        !draggingRef.current
      ) {
        if (edgeDirectionRef.current !== 0) {
          track.scrollLeft +=
            edgeDirectionRef.current * edgeSpeedRef.current * deltaTime;

          wrapScrollPosition();
        } else {
          const interactionPaused =
            posterHoveredRef.current || posterFocusedRef.current;

          if (autoplayEnabledRef.current && !interactionPaused) {
            track.scrollLeft += BASE_SPEED * deltaTime;
            wrapScrollPosition();
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    lastFrameTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      active = false;
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [wrapScrollPosition]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const track = trackRef.current;

    potentialDragRef.current = true;
    draggingRef.current = false;
    justDraggedRef.current = false;

    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    dragStartScrollRef.current = track?.scrollLeft ?? 0;
    pointerIdRef.current = event.pointerId;

    edgeDirectionRef.current = 0;
    edgeSpeedRef.current = 0;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const trackRect = track.getBoundingClientRect();
    const relativeX = event.clientX - trackRect.left;

    if (potentialDragRef.current || draggingRef.current) {
      const dragDistance = event.clientX - dragStartXRef.current;
      const verticalDistance = event.clientY - dragStartYRef.current;
      const threshold = event.pointerType === "touch" ? TOUCH_DRAG_THRESHOLD : DRAG_THRESHOLD;

      // Direction-aware: only commit to a horizontal drag once movement is
      // both past the threshold AND more horizontal than vertical, so a
      // genuinely vertical swipe (scrolling the page) is never hijacked.
      if (!draggingRef.current && Math.abs(dragDistance) > threshold && Math.abs(dragDistance) >= Math.abs(verticalDistance)) {
        draggingRef.current = true;

        try {
          track.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture may fail if the pointer is no longer active.
        }
      }

      if (draggingRef.current) {
        event.preventDefault();

        track.scrollLeft = dragStartScrollRef.current - dragDistance;

        wrapScrollPosition();
        return;
      }
    }

    // Edge scrolling is intended for a mouse or stylus, not touch.
    if (event.pointerType === "touch") {
      edgeDirectionRef.current = 0;
      edgeSpeedRef.current = 0;
      return;
    }

    if (relativeX < EDGE_ZONE) {
      const intensity = Math.min(
        1,
        Math.max(0, (EDGE_ZONE - relativeX) / EDGE_ZONE),
      );

      edgeDirectionRef.current = -1;
      edgeSpeedRef.current =
        EDGE_MIN_SPEED +
        (EDGE_MAX_SPEED - EDGE_MIN_SPEED) * Math.pow(intensity, 2);
    } else if (relativeX > trackRect.width - EDGE_ZONE) {
      const distanceFromRight = trackRect.width - relativeX;

      const intensity = Math.min(
        1,
        Math.max(0, (EDGE_ZONE - distanceFromRight) / EDGE_ZONE),
      );

      edgeDirectionRef.current = 1;
      edgeSpeedRef.current =
        EDGE_MIN_SPEED +
        (EDGE_MAX_SPEED - EDGE_MIN_SPEED) * Math.pow(intensity, 2);
    } else {
      edgeDirectionRef.current = 0;
      edgeSpeedRef.current = 0;
    }
  };

  const endDrag = () => {
    const track = trackRef.current;
    const pointerId = pointerIdRef.current;
    const wasDragging = draggingRef.current;

    potentialDragRef.current = false;
    draggingRef.current = false;

    if (track && pointerId !== null && track.hasPointerCapture(pointerId)) {
      try {
        track.releasePointerCapture(pointerId);
      } catch {
        // The browser may already have released the pointer.
      }
    }

    pointerIdRef.current = null;

    if (wasDragging) {
      justDraggedRef.current = true;

      window.setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);
    }
  };

  const handlePointerLeave = () => {
    endDrag();

    posterHoveredRef.current = false;
    edgeDirectionRef.current = 0;
    edgeSpeedRef.current = 0;
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!justDraggedRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    justDraggedRef.current = false;
  };

  const toggleAutoplay = () => {
    setAutoplayEnabled((currentlyEnabled) => {
      const nextValue = !currentlyEnabled;
      autoplayEnabledRef.current = nextValue;
      return nextValue;
    });
  };

  const renderSet = (copy: CarouselCopy) => {
    const isMiddleCopy = copy === "middle";

    const setRef =
      copy === "prefix"
        ? prefixSetRef
        : copy === "middle"
          ? middleSetRef
          : suffixSetRef;

    return (
      <div
        ref={setRef}
        className="flex shrink-0 gap-4 pr-4"
        aria-hidden={isMiddleCopy ? undefined : true}
      >
        {repeatedMovies.map(({ movie, sourceIndex, repeatIndex }) => {
          // Only the original movies in the first middle repetition are
          // included in keyboard navigation and the accessibility tree.
          const isAccessiblePoster = isMiddleCopy && repeatIndex === 0;

          return (
            <Link
              key={`${copy}-${repeatIndex}-${sourceIndex}-${movie.id}`}
              href={`/movies/${movie.id}`}
              tabIndex={isAccessiblePoster ? 0 : -1}
              aria-hidden={isAccessiblePoster ? undefined : true}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") {
                  posterHoveredRef.current = true;
                }
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== "touch") {
                  posterHoveredRef.current = false;
                }
              }}
              onFocus={() => {
                posterFocusedRef.current = true;
              }}
              onBlur={() => {
                posterFocusedRef.current = false;
              }}
              onDragStart={(event) => {
                event.preventDefault();
              }}
              className="focus-ring group relative w-[110px] shrink-0 select-none overflow-hidden rounded-xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-transform duration-[250ms] ease-out hover:z-20 hover:scale-[1.06] hover:shadow-[0_0_28px_rgba(255,255,255,0.22)] focus-visible:z-20 focus-visible:scale-[1.06] sm:w-[130px] md:w-[150px] lg:w-[170px]"
            >
              <MoviePoster
                movie={movie}
                className="pointer-events-none aspect-[2/3] w-full"
                eager={isAccessiblePoster && sourceIndex < 8}
              />
            </Link>
          );
        })}
      </div>
    );
  };

  if (movies.length === 0) {
    return null;
  }

  return (
    <section className="relative mt-16" aria-label={t("home.chainsTitle")}>
      <button
        type="button"
        onClick={toggleAutoplay}
        aria-pressed={!autoplayEnabled}
        aria-label={
          autoplayEnabled
            ? "Pause automatic scrolling"
            : "Start automatic scrolling"
        }
        title={
          autoplayEnabled
            ? "Pause automatic scrolling"
            : "Start automatic scrolling"
        }
        className="absolute right-4 top-0 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/75 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {autoplayEnabled ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="currentColor"
          >
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="currentColor"
          >
            <path d="M8 5.6v12.8c0 .78.86 1.26 1.53.85l10.1-6.4a1 1 0 0 0 0-1.7l-10.1-6.4A1 1 0 0 0 8 5.6Z" />
          </svg>
        )}
      </button>

      <div
        ref={trackRef}
        dir="ltr"
        role="region"
        aria-roledescription="carousel"
        aria-label={t("home.chainsTitle")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={handlePointerLeave}
        onClickCapture={handleClickCapture}
        className="cursor-grab select-none overflow-x-auto overflow-y-hidden py-7 active:cursor-grabbing [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          touchAction: "pan-y",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div ref={innerTrackRef} className="flex w-max px-4">
          {renderSet("prefix")}
          {renderSet("middle")}
          {renderSet("suffix")}
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        Automatic scrolling is {autoplayEnabled ? "playing" : "paused"}.
      </span>
    </section>
  );
}
