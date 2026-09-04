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

export const GET_HEALTH_METRICS = gql`
  query GetHealthMetrics {
    StylusContract {
      id
      isCached
      activatedAt
      expiresAt
      lastKeepalive
    }
    CacheEvent(order_by: { timestamp: desc }, limit: 100) {
      id
      codehash
      cached
      timestamp
    }
    LifetimeExtension(order_by: { timestamp: desc }, limit: 100) {
      id
      codehash
      timestamp
    }
    DailyStats(order_by: { date: desc }, limit: 30) {
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
