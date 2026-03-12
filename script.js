const projectCards = Array.from(document.querySelectorAll(".project-card"));

if (projectCards.length > 0) {
  let activeCard = null;
  let ticking = false;

  const setActiveCard = (card) => {
    if (card === activeCard) {
      return;
    }

    if (activeCard) {
      activeCard.classList.remove("is-active");
    }

    activeCard = card;

    if (activeCard) {
      activeCard.classList.add("is-active");
    }
  };

  const updateActiveCard = () => {
    ticking = false;

    const viewportFocus = window.innerHeight * 0.42;
    let bestCard = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const card of projectCards) {
      const rect = card.getBoundingClientRect();
      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;

      if (!isVisible) {
        continue;
      }

      const cardCenter = rect.top + rect.height / 2;
      const distance = Math.abs(cardCenter - viewportFocus);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestCard = card;
      }
    }

    setActiveCard(bestCard || projectCards[0]);
  };

  const requestUpdate = () => {
    if (ticking) {
      return;
    }

    ticking = true;
    window.requestAnimationFrame(updateActiveCard);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  window.addEventListener("load", requestUpdate);

  requestUpdate();
}
