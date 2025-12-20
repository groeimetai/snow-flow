/**
 * Service Discovery Client for Consul Integration
 */

import axios, { AxiosInstance } from 'axios';
import { Logger } from '../utils/logger.js';

export interface ServiceRegistration {
  id: string;
  name: string;
  address: string;
  port: number;
  health?: {
    http?: string;
    tcp?: string;
    interval?: string;
    timeout?: string;
    deregisterAfter?: string;
  };
  tags?: string[];
  meta?: Record<string, string>;
}

export interface ServiceDiscoveryConfig {
  consulUrl: string;
  timeout: number;
  retryAttempts: number;
}

export class ServiceDiscoveryClient {
  private client: AxiosInstance;
  private logger: Logger;
  private config: ServiceDiscoveryConfig;

  constructor(config?: Partial<ServiceDiscoveryConfig>) {
    this.config = {
      consulUrl: process.env.CONSUL_URL || 'http://consul:8500',
      timeout: 5000,
      retryAttempts: 3,
      ...config
    };

    this.logger = new Logger('ServiceDiscovery');

    this.client = axios.create({
      baseURL: this.config.consulUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug(`Making request to Consul: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          this.logger.warn('Consul is not available, running without service discovery');
        } else {
          this.logger.error('Consul request failed:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Register a service with Consul
   */
  async register(service: ServiceRegistration): Promise<void> {
    const registration = {
      ID: service.id,
      Name: service.name,
      Address: service.address,
      Port: service.port,
      Tags: service.tags || [],
      Meta: {
        version: '1.0.0',
        ...(service.meta || {})
      }
    };

    // Add health check if specified
    if (service.health) {
      const check: any = {
        Interval: service.health.interval || '30s',
        Timeout: service.health.timeout || '10s',
        DeregisterCriticalServiceAfter: service.health.deregisterAfter || '1m'
      };

      if (service.health.http) {
        check.HTTP = service.health.http;
      } else if (service.health.tcp) {
        check.TCP = service.health.tcp;
      }

      registration['Check'] = check;
    }

    let lastError: any;
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await this.client.put(`/v1/agent/service/register`, registration);
        this.logger.info(`Service registered: ${service.name} (${service.id})`);
        return;
      } catch (error: any) {
        lastError = error;
        if (attempt < this.config.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          this.logger.warn(`Registration attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to register service after ${this.config.retryAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Deregister a service from Consul
   */
  async deregister(serviceId: string): Promise<void> {
    try {
      await this.client.put(`/v1/agent/service/deregister/${serviceId}`);
      this.logger.info(`Service deregistered: ${serviceId}`);
    } catch (error: any) {
      this.logger.error(`Failed to deregister service ${serviceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Discover services by name
   */
  async discover(serviceName: string, healthy = true): Promise<ServiceInstance[]> {
    try {
      const endpoint = healthy 
        ? `/v1/health/service/${serviceName}?passing=true`
        : `/v1/health/service/${serviceName}`;
      
      const response = await this.client.get(endpoint);
      
      return response.data.map((entry: any) => ({
        id: entry.Service.ID,
        name: entry.Service.Service,
        address: entry.Service.Address,
        port: entry.Service.Port,
        tags: entry.Service.Tags,
        meta: entry.Service.Meta,
        health: entry.Checks?.map((check: any) => ({
          status: check.Status,
          output: check.Output,
          name: check.Name
        }))
      }));
    } catch (error: any) {
      this.logger.error(`Failed to discover service ${serviceName}:`, error.message);
      throw error;
    }
  }

  /**
   * List all services
   */
  async listServices(): Promise<string[]> {
    try {
      const response = await this.client.get('/v1/agent/services');
      return Object.keys(response.data);
    } catch (error: any) {
      this.logger.error('Failed to list services:', error.message);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getServiceHealth(serviceName: string): Promise<ServiceHealth[]> {
    try {
      const response = await this.client.get(`/v1/health/service/${serviceName}`);
      
      return response.data.map((entry: any) => ({
        serviceId: entry.Service.ID,
        serviceName: entry.Service.Service,
        address: entry.Service.Address,
        port: entry.Service.Port,
        checks: entry.Checks.map((check: any) => ({
          checkId: check.CheckID,
          name: check.Name,
          status: check.Status,
          output: check.Output
        }))
      }));
    } catch (error: any) {
      this.logger.error(`Failed to get health for service ${serviceName}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if Consul is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.get('/v1/status/leader');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Watch for service changes (simplified polling approach)
   */
  watchService(serviceName: string, callback: (services: ServiceInstance[]) => void, interval = 10000): () => void {
    let isWatching = true;
    
    const poll = async () => {
      if (!isWatching) return;
      
      try {
        const services = await this.discover(serviceName);
        callback(services);
      } catch (error) {
        this.logger.warn(`Failed to poll service ${serviceName}:`, error);
      }
      
      if (isWatching) {
        setTimeout(poll, interval);
      }
    };

    poll();

    return () => {
      isWatching = false;
    };
  }

  /**
   * COMPATIBILITY FIX: makeRequest method for phantom calls
   */
  async makeRequest(config: any): Promise<any> {
    console.error('🔧 ServiceDiscoveryClient.makeRequest called with config:', config);
    
    try {
      // Route the request to the appropriate HTTP method
      const method = (config.method || 'GET').toLowerCase();
      const url = config.url || config.endpoint;
      const data = config.data || config.body;
      
      console.error(`🔧 ServiceDiscovery routing ${method.toUpperCase()} request to: ${url}`);
      
      switch (method) {
        case 'get':
          return await this.client.get(url, { params: config.params });
        case 'post':
          return await this.client.post(url, data);
        case 'put':
          return await this.client.put(url, data);
        case 'patch':
          return await this.client.patch(url, data);
        case 'delete':
          return await this.client.delete(url);
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }
    } catch (error) {
      console.error('🔧 ServiceDiscoveryClient makeRequest error:', error);
      throw error;
    }
  }
}

export interface ServiceInstance {
  id: string;
  name: string;
  address: string;
  port: number;
  tags: string[];
  meta: Record<string, string>;
  health?: Array<{
    status: string;
    output: string;
    name: string;
  }>;
}

export interface ServiceHealth {
  serviceId: string;
  serviceName: string;
  address: string;
  port: number;
  checks: Array<{
    checkId: string;
    name: string;
    status: string;
    output: string;
  }>;
}