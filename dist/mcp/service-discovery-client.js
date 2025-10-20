"use strict";
/**
 * Service Discovery Client for Consul Integration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceDiscoveryClient = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_js_1 = require("../utils/logger.js");
class ServiceDiscoveryClient {
    constructor(config) {
        this.config = {
            consulUrl: process.env.CONSUL_URL || 'http://consul:8500',
            timeout: 5000,
            retryAttempts: 3,
            ...config
        };
        this.logger = new logger_js_1.Logger('ServiceDiscovery');
        this.client = axios_1.default.create({
            baseURL: this.config.consulUrl,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        // Request interceptor for logging
        this.client.interceptors.request.use((config) => {
            this.logger.debug(`Making request to Consul: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        }, (error) => {
            this.logger.error('Request interceptor error:', error);
            return Promise.reject(error);
        });
        // Response interceptor for error handling
        this.client.interceptors.response.use((response) => response, (error) => {
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                this.logger.warn('Consul is not available, running without service discovery');
            }
            else {
                this.logger.error('Consul request failed:', error.message);
            }
            return Promise.reject(error);
        });
    }
    /**
     * Register a service with Consul
     */
    async register(service) {
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
            const check = {
                Interval: service.health.interval || '30s',
                Timeout: service.health.timeout || '10s',
                DeregisterCriticalServiceAfter: service.health.deregisterAfter || '1m'
            };
            if (service.health.http) {
                check.HTTP = service.health.http;
            }
            else if (service.health.tcp) {
                check.TCP = service.health.tcp;
            }
            registration['Check'] = check;
        }
        let lastError;
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                await this.client.put(`/v1/agent/service/register`, registration);
                this.logger.info(`Service registered: ${service.name} (${service.id})`);
                return;
            }
            catch (error) {
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
    async deregister(serviceId) {
        try {
            await this.client.put(`/v1/agent/service/deregister/${serviceId}`);
            this.logger.info(`Service deregistered: ${serviceId}`);
        }
        catch (error) {
            this.logger.error(`Failed to deregister service ${serviceId}:`, error.message);
            throw error;
        }
    }
    /**
     * Discover services by name
     */
    async discover(serviceName, healthy = true) {
        try {
            const endpoint = healthy
                ? `/v1/health/service/${serviceName}?passing=true`
                : `/v1/health/service/${serviceName}`;
            const response = await this.client.get(endpoint);
            return response.data.map((entry) => ({
                id: entry.Service.ID,
                name: entry.Service.Service,
                address: entry.Service.Address,
                port: entry.Service.Port,
                tags: entry.Service.Tags,
                meta: entry.Service.Meta,
                health: entry.Checks?.map((check) => ({
                    status: check.Status,
                    output: check.Output,
                    name: check.Name
                }))
            }));
        }
        catch (error) {
            this.logger.error(`Failed to discover service ${serviceName}:`, error.message);
            throw error;
        }
    }
    /**
     * List all services
     */
    async listServices() {
        try {
            const response = await this.client.get('/v1/agent/services');
            return Object.keys(response.data);
        }
        catch (error) {
            this.logger.error('Failed to list services:', error.message);
            throw error;
        }
    }
    /**
     * Get service health status
     */
    async getServiceHealth(serviceName) {
        try {
            const response = await this.client.get(`/v1/health/service/${serviceName}`);
            return response.data.map((entry) => ({
                serviceId: entry.Service.ID,
                serviceName: entry.Service.Service,
                address: entry.Service.Address,
                port: entry.Service.Port,
                checks: entry.Checks.map((check) => ({
                    checkId: check.CheckID,
                    name: check.Name,
                    status: check.Status,
                    output: check.Output
                }))
            }));
        }
        catch (error) {
            this.logger.error(`Failed to get health for service ${serviceName}:`, error.message);
            throw error;
        }
    }
    /**
     * Check if Consul is available
     */
    async isAvailable() {
        try {
            await this.client.get('/v1/status/leader');
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Watch for service changes (simplified polling approach)
     */
    watchService(serviceName, callback, interval = 10000) {
        let isWatching = true;
        const poll = async () => {
            if (!isWatching)
                return;
            try {
                const services = await this.discover(serviceName);
                callback(services);
            }
            catch (error) {
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
    async makeRequest(config) {
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
        }
        catch (error) {
            console.error('🔧 ServiceDiscoveryClient makeRequest error:', error);
            throw error;
        }
    }
}
exports.ServiceDiscoveryClient = ServiceDiscoveryClient;
//# sourceMappingURL=service-discovery-client.js.map