import { gql } from 'graphql-request';

export const GET_OVERVIEW_STATS = gql`
  query GetOverviewStats($since: Int!) {
    StylusContract_aggregate {
      aggregate {
        count
      }
    }
    GlobalStats {
      cumulativeDeployers
    }
    StylusContract(order_by: { activatedAt: desc }, limit: 10) {
      id
      deployer
      activatedAt
      isCached
    }
    DailyStats(where: { date: { _gte: $since } }, order_by: { date: desc }) {
      id
      date
      stylusActivations
      stylusReactivations
      uniqueDeployers
      totalStylusContracts
      cacheEvents
    }
  }
`;

// The chart's "all" period is the only thing that needs the whole history, so
// it lives in its own query and stays off the 5-second poll. Newest first: if a
// row cap is ever configured it should drop ancient days, not recent ones.
export const GET_ACTIVATION_HISTORY = gql`
  query GetActivationHistory {
    DailyStats(order_by: { date: desc }) {
      date
      stylusActivations
    }
  }
`;

export const GET_CONTRACTS = gql`
  query GetContracts($limit: Int, $offset: Int, $orderBy: [StylusContract_order_by!]) {
    StylusContract(order_by: $orderBy, limit: $limit, offset: $offset) {
      id
      deployer
      version
      activatedAt
      isCached
      expiresAt
    }
  }
`;

export const GET_BUILDER_STATS = gql`
  query GetBuilderStats {
    StylusContract(order_by: { activatedAt: asc }) {
      deployer
      activatedAt
    }
    DailyStats(order_by: { date: asc }) {
      id
      cumulativeDeployers
    }
  }
`;

// Six filtered counts instead of the table. They partition every contract, so
// the status pie is three sums over them and no separate total is needed.
export const GET_HEALTH_METRICS = gql`
  query GetHealthMetrics($now: Int!, $d7: Int!, $d30: Int!, $d90: Int!, $d180: Int!, $since: Int!) {
    expired: StylusContract_aggregate(where: { expiresAt: { _lt: $now } }) {
      aggregate {
        count
      }
    }
    under7d: StylusContract_aggregate(where: { expiresAt: { _gte: $now, _lt: $d7 } }) {
      aggregate {
        count
      }
    }
    from7to30d: StylusContract_aggregate(where: { expiresAt: { _gte: $d7, _lt: $d30 } }) {
      aggregate {
        count
      }
    }
    from30to90d: StylusContract_aggregate(where: { expiresAt: { _gte: $d30, _lt: $d90 } }) {
      aggregate {
        count
      }
    }
    from90to180d: StylusContract_aggregate(where: { expiresAt: { _gte: $d90, _lt: $d180 } }) {
      aggregate {
        count
      }
    }
    # A null expiresAt has no expiry set yet. The comparisons above drop it on
    # their own, so the farthest-out bucket has to claim it explicitly, which is
    # where getExpiryBucket has always put it.
    over180d: StylusContract_aggregate(
      where: { _or: [{ expiresAt: { _is_null: true } }, { expiresAt: { _gte: $d180 } }] }
    ) {
      aggregate {
        count
      }
    }
    DailyStats(where: { date: { _gte: $since } }, order_by: { date: desc }) {
      date
      stylusActivations
      stylusReactivations
    }
  }
`;
