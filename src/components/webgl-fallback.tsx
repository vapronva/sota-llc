"use client";

import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
  onError?: () => void;
}

interface State {
  hasError: boolean;
}

export class WebGLErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }
  override componentDidCatch() {
    this.props.onError?.();
  }
  override render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
