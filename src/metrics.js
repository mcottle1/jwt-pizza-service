const config = require('./config.js');
const os = require('os');

class Metrics {
  constructor() {
    this.totalRequests = 0;
    this.getRequests = 0;
    this.postRequests = 0;
    this.deleteRequests = 0;
    this.putRequests = 0;
    this.activeUsers = 0;
    this.goodAuthAttempts = 0;
    this.badAuthAttempts = 0;
    this.soldPizzas = 0;
    this.revenue = 0;
    this.creationFailures = 0;
    this.latency = 0
    this.pizzaLatency = 0;
    this.chaos = 0;

    this.sendMetricsPeriodically(3000);
  }

  httpMetrics(metricString) {
    metricString.push(`request,source=${config.metrics.source},method=all total=${this.totalRequests}`);
    metricString.push(`request,source=${config.metrics.source},method=get get=${this.getRequests}`);
    metricString.push(`request,source=${config.metrics.source},method=post post=${this.postRequests}`);
    metricString.push(`request,source=${config.metrics.source},method=delete delete=${this.deleteRequests}`);
    metricString.push(`request,source=${config.metrics.source},method=put put=${this.putRequests}`);
    metricString.push(`chaos,source=${config.metrics.source} chaos=${this.chaos}`);
  }

  systemMetrics(metricString) {
    const cpuUsage = this.getCpuUsagePercentage();
    const memoryUsage = this.getMemoryUsagePercentage();
    metricString.push(`system,source=${config.metrics.source} cpu=${cpuUsage}`);
    metricString.push(`system,source=${config.metrics.source} memory=${memoryUsage}`);
  }

  authMetrics(metricString) {
    metricString.push(`auth,source=${config.metrics.source} good=${this.goodAuthAttempts}`);
    metricString.push(`auth,source=${config.metrics.source} bad=${this.badAuthAttempts}`);
  }

  userMetrics(metricString) {
    metricString.push(`user,source=${config.metrics.source} users=${this.activeUsers}`);
  }

  purchaseMetrics(metricString) {
    metricString.push(`purchase,source=${config.metrics.source} sold=${this.soldPizzas}`);
    metricString.push(`purchase,source=${config.metrics.source} renevue=${this.revenue}`);
    metricString.push(`purchase,source=${config.metrics.source} creationFailure=${this.creationFailures}`);
  }

  latencyMetrics(metricString) {
    metricString.push(`latency,source=${config.metrics.source} latency=${this.latency}`);
    metricString.push(`latency,source=${config.metrics.source} pizzaLatency=${this.pizzaLatency}`);
  }

  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  sendMetricToGrafana(metrics) {
    fetch(`${config.metrics.url}`, {
      method: 'post',
      body: metrics,
      headers: { Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}` },
    });
  }

  sendMetricsPeriodically(period) {
    setInterval(() => {
      try {
        const metricString = [];
        this.httpMetrics(metricString);
        this.systemMetrics(metricString);
        this.userMetrics(metricString);
        this.purchaseMetrics(metricString);
        this.authMetrics(metricString);
        this.latencyMetrics(metricString);
        const metrics = metricString.join('\n');
        this.sendMetricToGrafana(metrics);
      } catch (error) {
        console.log('Error sending metrics', error);
      }
    }, period);
  }

  requestTracker = (req, res, next) => {
    const start = Date.now();
    const url = req.url;
    metrics.totalRequests++;

    if (req.method === 'POST') {
      metrics.postRequests++;
    }
    if (req.method === 'GET') {
      metrics.getRequests++;
    }
    if (req.method === 'DELETE') {
      metrics.deleteRequests++;
    }
    if (req.method === 'PUT') {
      metrics.putRequests++;
      if (url.startsWith('/chaos/')) {
        metrics.chaos++;
      }
    }

    res.on('finish', () => {
        const duration = Date.now() - start;
        metrics.latency += duration;
        if(res.statusCode === 200 && url === '/api/auth' && (req.method === 'POST' || req.method === 'PUT')) {
          metrics.activeUsers++;
        }
        if(res.statusCode === 200 && url === '/api/auth' && req.method === 'DELETE') {
          metrics.activeUsers--;
        }
        if(res.statusCode === 200 && url === '/api/auth') {
          metrics.goodAuthAttempts++;
        }
        if(res.statusCode !== 200 && url === '/api/auth') {
          metrics.badAuthAttempts++;
        }
        if(res.statusCode === 200 && url === '/api/oder' && req.method === 'POST') {
          console.log('sold a pizza');
          metrics.soldPizzas++;
        }
        if(url === '/api/order' && req.method === 'POST') {
          if(res.statusCode === 200) {
            for(let i = 0; i < req.body.items.length; i++) {
              metrics.soldPizzas++;
              metrics.revenue += req.body.items[i].price;
            }
            metrics.pizzaLatency += duration;
          }else{
            metrics.creationFailures++;
          }
        }
    });

    next();
  };  
}

const metrics = new Metrics();
module.exports = metrics;
