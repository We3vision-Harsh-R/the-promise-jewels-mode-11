import { RobotsPolicy } from "@prisma/client";

export function buildRobots(policy: RobotsPolicy) {
  switch (policy) {
    case RobotsPolicy.INDEX_FOLLOW:
      return {
        index: true,
        follow: true,
      };

    case RobotsPolicy.INDEX_NOFOLLOW:
      return {
        index: true,
        follow: false,
      };

    case RobotsPolicy.NOINDEX_FOLLOW:
      return {
        index: false,
        follow: true,
      };

    case RobotsPolicy.NOINDEX_NOFOLLOW:
      return {
        index: false,
        follow: false,
      };

    default:
      return {
        index: true,
        follow: true,
      };
  }
}
