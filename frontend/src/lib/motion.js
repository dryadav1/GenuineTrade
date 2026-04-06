export const softEase = [0.22, 1, 0.36, 1];
export const softSpring = {
  type: "spring",
  stiffness: 280,
  damping: 26,
  mass: 0.85
};

export const pageTransitionVariants = {
  initial: {
    opacity: 0,
    y: 18,
    filter: "blur(8px)"
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.44,
      ease: softEase
    }
  },
  exit: {
    opacity: 0,
    y: -12,
    filter: "blur(10px)",
    transition: {
      duration: 0.26,
      ease: [0.4, 0, 1, 1]
    }
  }
};

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      delayChildren: 0.05,
      staggerChildren: 0.08
    }
  }
};

export const staggerItem = {
  initial: {
    opacity: 0,
    y: 18,
    scale: 0.985
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.42,
      ease: softEase
    }
  }
};

export const navListVariants = {
  initial: {},
  animate: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.05
    }
  }
};

export const navItemVariants = {
  initial: {
    opacity: 0,
    x: -16
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.34,
      ease: softEase
    }
  }
};

export const dropdownVariants = {
  initial: {
    opacity: 0,
    y: -10,
    scale: 0.98
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.22,
      ease: softEase
    }
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: {
      duration: 0.16,
      ease: [0.4, 0, 1, 1]
    }
  }
};

export const tooltipVariants = {
  initial: {
    opacity: 0,
    y: 6,
    scale: 0.96
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.18,
      ease: softEase
    }
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.96,
    transition: {
      duration: 0.12,
      ease: [0.4, 0, 1, 1]
    }
  }
};

export const modalBackdropVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.2
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.16
    }
  }
};

export const modalPanelVariants = {
  initial: {
    opacity: 0,
    scale: 0.94,
    y: 24
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: softEase
    }
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 16,
    transition: {
      duration: 0.18,
      ease: [0.4, 0, 1, 1]
    }
  }
};

export const sidebarVariants = {
  closed: {
    x: "-100%",
    transition: {
      duration: 0.22,
      ease: [0.4, 0, 1, 1]
    }
  },
  open: {
    x: 0,
    transition: {
      duration: 0.28,
      ease: softEase
    }
  }
};

export const messageStackVariants = {
  initial: {},
  animate: {
    transition: {
      delayChildren: 0.03,
      staggerChildren: 0.05
    }
  }
};

export const messageBubbleVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.985
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.32,
      ease: softEase
    }
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.98,
    transition: {
      duration: 0.16,
      ease: [0.4, 0, 1, 1]
    }
  }
};

export const chartBarVariants = {
  initial: {
    opacity: 0,
    scaleX: 0.2
  },
  animate: (index = 0) => ({
    opacity: 1,
    scaleX: 1,
    transition: {
      duration: 0.46,
      delay: index * 0.07,
      ease: softEase
    }
  })
};

export const hoverLift = {
  whileHover: {
    y: -6,
    scale: 1.01,
    boxShadow: "0 28px 65px rgba(11, 31, 58, 0.14)"
  },
  whileTap: {
    scale: 0.985
  },
  transition: {
    duration: 0.2,
    ease: softEase
  }
};

export const buttonMotion = {
  whileHover: {
    scale: 1.05,
    y: -2
  },
  whileTap: {
    scale: 0.98,
    y: 0
  },
  transition: {
    duration: 0.18,
    ease: softEase
  }
};
