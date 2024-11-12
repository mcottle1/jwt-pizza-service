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
    this.logouts = 0;
    // this.activeUsers = 0;
    // this.successfulAuths = 0;
    // this.failedAuths = 0;
    // this.soldPizzas = 0;
    // this.failedPizzas = 0;
    // this.totalRevenue = 0;
    // this.totalRequestTimeSinceInterval = 0;
    // this.totalPizzaTimeSinceInterval = 0;

    // This will periodically sent metrics to Grafana
    const timer = setInterval(() => {
      this.sendMetricToGrafana('request', 'all', 'total', this.totalRequests);
      this.sendMetricToGrafana('request', 'get', 'get', this.getRequests);
      this.sendMetricToGrafana('request', 'post', 'post', this.postRequests);
      this.sendMetricToGrafana('request', 'delete', 'delete', this.deleteRequests);
      this.sendMetricToGrafana('request', 'put', 'put', this.putRequests);
      this.sendMetricToGrafana('cpu', 'all', 'usage', this.getCpuUsagePercentage());
      this.sendMetricToGrafana('memory', 'all', 'usage', this.getMemoryUsagePercentage());
      this.sendMetricToGrafana('users', 'all', 'logins', this.logins);
      this.sendMetricToGrafana('users', 'all', 'logouts', this.logouts);
    //   this.sendMetricToGrafana('auth', 'all', 'successful', this.successfulAuths);
    //   this.sendMetricToGrafana('auth', 'all', 'failed', this.failedAuths);
    //   this.sendMetricToGrafana('pizzas', 'all', 'soldpizzas', this.soldPizzas);
    //   this.sendMetricToGrafana('pizzas', 'all', 'failedpizzas', this.failedPizzas);
    //   this.sendMetricToGrafana('pizzas', 'all', 'totalrevenue', this.totalRevenue);
    //   this.sendMetricToGrafana('latency', 'all', 'latency', this.totalRequestTimeSinceInterval);
    //   this.sendMetricToGrafana('latency', 'all', 'pizzalatency', this.totalPizzaTimeSinceInterval);
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

  incrementLogouts() {
    this.logouts++;
}

//   incrementSuccessfulAuths() {
//     this.successfulAuths++;
//   }

//   incrementFailedAuths() {
//     this.failedAuths++;
//   }

//   incrementPizzas() {
//     this.soldPizzas++;
//   }

//   incrementFailedPizzas() {
//     this.failedPizzas++;
//   }

//   incrementRevenue(revenue) {
//     this.successfulAuths = this.totalRevenue + revenue;
//   }

  incrementRequestTimeSinceInterval(duration) {
    this.totalRequestTimeSinceInterval = this.totalRequestTimeSinceInterval + duration;
  }

//   incrementPizzaRequestTimeSinceInterval(duration) {
//     this.totalPizzaTimeSinceInterval = this.totalPizzaTimeSinceInterval + duration;
//   }

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
            if (req.url === '/api/auth') {
                metrics.incrementLogouts();
            }
        }
        if (req.method === 'PUT') {
            metrics.incrementPutRequests();
            if (req.url === '/api/auth') {
                metrics.incrementLogins();
            }
        }
        // if (req.url === '/api/auth') {
        //     metrics.decrementUsers();
        // }
        // if (req.url === '/api/auth') {
        //     if(res.body.status === 200) {
        //         metrics.incrementUsers();
        //         metrics.incrementSuccessfulAuths();
        //     }else{
        //         metrics.incrementFailedAuths();
        //     }
        // }
        // if (req.url === '/api/order') {
        //     metrics.incrementPizzaRequestTimeSinceInterval(duration);
        //     req.body.items.forEach(item => {
        //         if (res.body.status === 200) {
        //             metrics.incrementPizzas();
        //             metrics.incrementRevenue(item.price);
        //         } else{
        //             metrics.incrementFailedPizzas();
        //         }
        //     });
        // }
    });

    next();
  };  
}

const metrics = new Metrics();
module.exports = metrics;
