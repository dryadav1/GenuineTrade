export default function SkeletonBlock({
  className = "",
  rounded = "rounded-2xl"
}) {
  return <div className={`skeleton-shimmer ${rounded} ${className}`} />;
}
