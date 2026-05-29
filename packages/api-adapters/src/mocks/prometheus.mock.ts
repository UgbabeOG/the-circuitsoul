export const mockPrometheus = {
  async queryMetric(query: string, time?: string) {
    console.log(`[MOCK PROMETHEUS] Running query: ${query} (time: ${time || 'now'})`);
    return {
      status: "success",
      data: {
        resultType: "vector",
        result: [
          {
            metric: {},
            value: [Date.now() / 1000, (Math.random() * 40 + 20).toFixed(2)]
          }
        ]
      }
    };
  },

  async getResourceMetrics(hostId: string) {
    console.log(`[MOCK PROMETHEUS] Generating CPU and Memory usage for host ${hostId}`);
    
    // Simulate realistic usage values that vary slightly
    const randomCpu = Math.floor(Math.random() * 30) + 15; // 15% - 45%
    const randomMem = Math.floor(Math.random() * 20) + 50; // 50% - 70%
    const costDaily = parseFloat((Math.random() * 5 + 2).toFixed(2)); // $2.00 - $7.00
    
    return {
      cpu: randomCpu,
      memory: randomMem,
      costDaily: costDaily,
      score: Math.max(70, Math.floor(100 - (randomCpu * 0.4) - (randomMem * 0.3))),
      timestamp: new Date().toISOString()
    };
  }
};
