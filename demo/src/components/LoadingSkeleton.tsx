/**
 * Loading skeleton component for Suspense fallback
 */
export default function LoadingSkeleton(): JSX.Element {
  return (
    <div style="background: #f0f0f0; padding: 1rem; border-radius: 8px; animation: pulse 1.5s infinite;">
      <div style="height: 20px; background: #ddd; border-radius: 4px; margin-bottom: 0.5rem; width: 60%;"></div>
      <div style="height: 16px; background: #ddd; border-radius: 4px; width: 80%;"></div>
    </div>
  );
}
