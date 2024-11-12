const config = require('./config.js');
const os = require('os');

class Metrics {
  constructor() {
    this.totalRequests = 0;
    this.getRequests = 0;
    this.postRequests = 0;
    this.deleteRequests = 0;
    this.putRequests = 0;
    this.logins = 0;

    const timer = setInterval(() => {
      this.sendMetricToGrafana('request', 'all', 'total', this.totalRequests);
      this.sendMetricToGrafana('request', 'get', 'get', this.getRequests);
      this.sendMetricToGrafana('request', 'post', 'post', this.postRequests);
      this.sendMetricToGrafana('request', 'delete', 'delete', this.deleteRequests);
      this.sendMetricToGrafana('request', 'put', 'put', this.putRequests);
      this.sendMetricToGrafana('cpu', 'all', 'usage', this.getCpuUsagePercentage());
      this.sendMetricToGrafana('memory', 'all', 'usage', this.getMemoryUsagePercentage());
      this.sendMetricToGrafana('users', 'all', 'logins', this.logins);
    }, 3000);
    timer.unref();
  }

  incrementRequests() {
    this.totalRequests++;
  }

  incrementGetRequests() {
    this.getRequests++;
  }

  incrementPostRequests() {
    this.postRequests++;
  }

  incrementDeleteRequests() {
    this.deleteRequests++;
  }

  incrementPutRequests() {
    this.putRequests++;
  }

  incrementLogins() {
    this.logins++;
  }

  incrementRequestTimeSinceInterval(duration) {
    this.totalRequestTimeSinceInterval = this.totalRequestTimeSinceInterval + duration;
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

  sendMetricToGrafana(metricPrefix, httpMethod, metricName, metricValue) {
    const metric = `${metricPrefix},source=${config.metrics.source},method=${httpMethod} ${metricName}=${metricValue}`;

    fetch(`${config.metrics.url}`, {
      method: 'post',
      body: metric,
      headers: { Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}` },
    });
  }

  requestTracker = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        metrics.incrementRequests();
        metrics.incrementRequestTimeSinceInterval(duration);

        if (req.method === 'POST') {
            metrics.incrementPostRequests();
        }
        if (req.method === 'GET') {
            metrics.incrementGetRequests();
        }
        if (req.method === 'DELETE') {
            metrics.incrementDeleteRequests();
        }
        if (req.method === 'PUT') {
            metrics.incrementPutRequests();
        }
        if (req.method === 'PUT' && req.url === '/api/auth') {
            metrics.incrementLogins();
        }
    });

    next();
  };  
}

const metrics = new Metrics();
module.exports = metrics;
