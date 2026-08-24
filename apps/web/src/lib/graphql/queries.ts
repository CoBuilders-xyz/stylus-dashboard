import { gql } from 'graphql-request';

export const GET_OVERVIEW_STATS = gql`
  query GetOverviewStats {
    StylusContract(order_by: { activatedAt: desc }) {
      id
      deployer
      activatedAt
      isCached
      expiresAt
    }
    DailyStats(order_by: { date: desc }) {
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
