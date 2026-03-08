"use client";

import { useRef, useEffect, useState, Children, cloneElement, isValidElement } from "react";

interface StaggerChildrenProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerChildren({
  children,
  className,
  staggerDelay = 0.08,
}: StaggerChildrenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "-60px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let index = 0;

  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child) => {
        if (isValidElement(child) && child.type === StaggerItem) {
          const currentIndex = index++;
          return cloneElement(child as React.ReactElement<StaggerItemInternalProps>, {
            _visible: isVisible,
            _delay: currentIndex * staggerDelay,
          });
        }
        return child;
      })}
    </div>
  );
}

interface StaggerItemInternalProps {
  _visible?: boolean;
  _delay?: number;
}

export function StaggerItem({
  children,
  className,
  _visible = false,
  _delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
} & StaggerItemInternalProps) {
  return (
    <div
      className={className}
      style={{
        opacity: _visible ? 1 : 0,
        transform: _visible ? "none" : "translateY(20px)",
        transition: `opacity 0.4s cubic-bezier(0.25,0.1,0.25,1) ${_delay}s, transform 0.4s cubic-bezier(0.25,0.1,0.25,1) ${_delay}s`,
      }}
    >
      {children}
    </div>
  );
}
