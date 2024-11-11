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
    this.successfulAuths = 0;
    this.failedAuths = 0;
    this.soldPizzas = 0;
    this.failedPizzas = 0;
    this.totalRevenue = 0;
    this.totalRequestsSinceInterval = 0;
    this.totalRequestTimeSinceInterval = 0;
    this.totalPizzasSinceInterval = 0;
    this.totalPizzaTimeSinceInterval = 0;

    // This will periodically sent metrics to Grafana
    const timer = setInterval(() => {
      this.sendMetricToGrafana('request', 'all', 'total', this.totalRequests);
      this.sendMetricToGrafana('request', 'get', 'get', this.getRequests);
      this.sendMetricToGrafana('request', 'post', 'post', this.postRequests);
      this.sendMetricToGrafana('request', 'delete', 'delete', this.deleteRequests);
      this.sendMetricToGrafana('request', 'put', 'put', this.putRequests);
      this.sendMetricToGrafana('cpu', 'all', 'usage', this.getCpuUsagePercentage());
      this.sendMetricToGrafana('memory', 'all', 'usage', this.getMemoryUsagePercentage());
      this.sendMetricToGrafana('users', 'all', 'activeusers', this.activeUsers);
      this.sendMetricToGrafana('auth', 'all', 'successful', this.successfulAuths);
      this.sendMetricToGrafana('auth', 'all', 'failed', this.failedAuths);
      this.sendMetricToGrafana('pizzas', 'all', 'soldpizzas', this.soldPizzas);
      this.sendMetricToGrafana('pizzas', 'all', 'failedpizzas', this.failedPizzas);
      this.sendMetricToGrafana('pizzas', 'all', 'totalrevenue', this.totalRevenue);
      this.sendMetricToGrafana('latency', 'all', 'latency', this.calculateAverageLatency());
      this.totalRequestsSinceInterval = 0;
      this.totalRequestTimeSinceInterval = 0;
      this.sendMetricToGrafana('latency', 'all', 'pizzalatency', this.calculateAveragePizzaLatency());
      this.totalPizzasSinceInterval = 0;
      this.totalPizzaTimeSinceInterval = 0;
    }, 10000);
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

  incrementUsers() {
    this.activeUsers++;
  }

  decrementUsers() {
    this.decrementUsers--;
  }

  incrementSuccessfulAuths() {
    this.successfulAuths++;
  }

  incrementFailedAuths() {
    this.failedAuths++;
  }

  incrementPizzas() {
    this.soldPizzas++;
  }

  incrementFailedPizzas() {
    this.failedPizzas++;
  }

  incrementRevenue(revenue) {
    this.successfulAuths = this.totalRevenue + revenue;
  }

  incrementRequestsSinceInterval() {
    this.totalRequestsSinceInterval++;
  }

  incrementRequestTimeSinceInterval(duration) {
    this.totalRequestTimeSinceInterval = this.totalRequestTimeSinceInterval + duration;
  }

  calculateAverageLatency() {
    if(this.totalRequestsSinceInterval === 0) {
      return 0;
    }
    return this.totalRequestTimeSinceInterval / this.totalRequestsSinceInterval;
  }

  incrementPizzaRequestsSinceInterval() {
    this.totalPizzasSinceInterval++;
  }

  incrementPizzaRequestTimeSinceInterval(duration) {
    this.totalPizzaTimeSinceInterval = this.totalPizzaTimeSinceInterval + duration;
  }

  calculateAveragePizzaLatency() {
    if(this.totalPizzasSinceInterval === 0) {
      return 0;
    }
    return this.totalPizzaTimeSinceInterval / this.totalPizzasSinceInterval;
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
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to push metrics data to Grafana');
          console.error(response);
        } else {
          console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }

  requestTracker = (req, res, next) => {
    console.log(`Received request: ${req.method} ${req.url}`);
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`Request ${req.method} ${req.url} took ${duration}ms`);
        metrics.incrementRequests();
        metrics.incrementRequestsSinceInterval();
        metrics.incrementRequestTimeSinceInterval(duration);

        if (req.method === 'POST') {
            metrics.incrementPostRequests();
            if (req.url === '/api/auth') {
                if(res.statusCode === 200) {
                    metrics.incrementUsers();
                    metrics.incrementSuccessfulAuths();
                }else{
                    metrics.incrementFailedAuths();
                }
            }
        }
        if (req.method === 'GET') {
            metrics.incrementGetRequests();
        }
        if (req.method === 'DELETE') {
            metrics.incrementDeleteRequests();
            if (req.url === '/api/auth') {
                metrics.decrementUsers();
            }
        }
        if (req.method === 'PUT') {
            metrics.incrementPutRequests();
            if (req.url === '/api/auth') {
                if(res.statusCode === 200) {
                    metrics.incrementUsers();
                    metrics.incrementSuccessfulAuths();
                }else{
                    metrics.incrementFailedAuths();
                }
            }
            if (req.url === '/api/order') {
                metrics.incrementPizzaRequestsSinceInterval();
                metrics.incrementPizzaRequestTimeSinceInterval(duration);
                req.body.items.forEach(item => {
                    if (res.statusCode !== 200) {
                        metrics.incrementFailedPizzas();
                    } else{
                        metrics.incrementPizzas();
                        metrics.incrementRevenue(item.price);
                    }
                });
            }
        }
    });

    next();
  };  
}

const metrics = new Metrics();
module.exports = metrics;
