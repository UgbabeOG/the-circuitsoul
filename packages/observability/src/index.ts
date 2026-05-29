import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export interface TelemetryConfig {
  serviceName?: string;
  otelEndpoint?: string;
}

export function initializeTelemetry(config: TelemetryConfig = {}) {
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: config.otelEndpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
    }),
    instrumentations: [getNodeAutoInstrumentations()]
  });

  sdk.start().catch(error => {
    console.error('Failed to start OpenTelemetry SDK', error);
  });

  return sdk;
}

export function createTelemetryMetadata(serviceName = 'circuitsoul') {
  return {
    serviceName,
    environment: process.env.NODE_ENV || 'development'
  };
}
