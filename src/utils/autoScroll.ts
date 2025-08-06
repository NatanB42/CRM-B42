// Auto-scroll functionality for drag and drop
export const setupAutoScroll = (container: HTMLElement, draggedElement: HTMLElement | null) => {
  if (!draggedElement) return;

  const scrollSpeed = 20;
  const scrollZone = 100; // pixels from edge to trigger scroll
  
  const handleMouseMove = (e: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Scroll right when near right edge
    if (x > rect.width - scrollZone) {
      container.scrollLeft += scrollSpeed;
    }
    // Scroll left when near left edge
    else if (x < scrollZone) {
      container.scrollLeft -= scrollSpeed;
    }
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// Touch support for mobile
export const setupTouchAutoScroll = (container: HTMLElement, draggedElement: HTMLElement | null) => {
  if (!draggedElement) return;

  const scrollSpeed = 15;
  const scrollZone = 80;
  
  const handleTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    
    if (x > rect.width - scrollZone) {
      container.scrollLeft += scrollSpeed;
    } else if (x < scrollZone) {
      container.scrollLeft -= scrollSpeed;
    }
  };

  const handleTouchEnd = () => {
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  };

  document.addEventListener('touchmove', handleTouchMove);
  document.addEventListener('touchend', handleTouchEnd);
};