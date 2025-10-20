/**
 * Service Discovery Client for Consul Integration
 */
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
export declare class ServiceDiscoveryClient {
    private client;
    private logger;
    private config;
    constructor(config?: Partial<ServiceDiscoveryConfig>);
    /**
     * Register a service with Consul
     */
    register(service: ServiceRegistration): Promise<void>;
    /**
     * Deregister a service from Consul
     */
    deregister(serviceId: string): Promise<void>;
    /**
     * Discover services by name
     */
    discover(serviceName: string, healthy?: boolean): Promise<ServiceInstance[]>;
    /**
     * List all services
     */
    listServices(): Promise<string[]>;
    /**
     * Get service health status
     */
    getServiceHealth(serviceName: string): Promise<ServiceHealth[]>;
    /**
     * Check if Consul is available
     */
    isAvailable(): Promise<boolean>;
    /**
     * Watch for service changes (simplified polling approach)
     */
    watchService(serviceName: string, callback: (services: ServiceInstance[]) => void, interval?: number): () => void;
    /**
     * COMPATIBILITY FIX: makeRequest method for phantom calls
     */
    makeRequest(config: any): Promise<any>;
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
//# sourceMappingURL=service-discovery-client.d.ts.map