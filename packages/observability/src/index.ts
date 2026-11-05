import { trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

export interface TelemetryConfig {
  serviceName?: string;
  otelEndpoint?: string;
  environment?: string;
}

export function initTelemetry(serviceName = 'circuitsoul', config: TelemetryConfig = {}) {
  const resolvedConfig = typeof serviceName === 'string' && serviceName !== 'circuitsoul' && !config.serviceName
    ? { ...config, serviceName }
    : config;

  const resolvedServiceName = resolvedConfig.serviceName ?? serviceName ?? 'circuitsoul';
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': resolvedServiceName,
      'service.namespace': 'circuitsoul',
      'deployment.environment': resolvedConfig.environment ?? process.env.NODE_ENV ?? 'development'
    }),
    traceExporter: new OTLPTraceExporter({
      url: resolvedConfig.otelEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4317'
    }),
    instrumentations: [getNodeAutoInstrumentations()]
  });

  try {
    sdk.start();
  } catch (error) {
    console.error('Failed to start OpenTelemetry SDK', error);
  }

  return sdk;
}

export function initializeTelemetry(configOrServiceName: string | TelemetryConfig = {}, maybeConfig?: TelemetryConfig) {
  if (typeof configOrServiceName === 'string') {
    return initTelemetry(configOrServiceName, maybeConfig ?? {});
  }

  return initTelemetry(configOrServiceName.serviceName ?? 'circuitsoul', configOrServiceName);
}

export function createTelemetryMetadata(serviceName = 'circuitsoul') {
  return {
    serviceName,
    environment: process.env.NODE_ENV || 'development'
  };
}

export function traceSpan(name: string, fn: () => Promise<unknown> | unknown) {
  return async () => {
    const tracer = trace.getTracer('circuitsoul');
    const span = tracer.startSpan(name);

    try {
      const result = await fn();
      span.setStatus({ code: 1 });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      span.end();
    }
  };
}

export function withSpan<T extends (...args: any[]) => Promise<any> | any>(name: string, fn: T): T {
  return (async (...args: Parameters<T>) => {
    const tracer = trace.getTracer('circuitsoul');
    const span = tracer.startSpan(name);

    try {
      const result = await fn(...args);
      span.setStatus({ code: 1 });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      span.end();
    }
  }) as T;
}
