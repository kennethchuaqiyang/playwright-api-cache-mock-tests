pipeline {
    agent {
        docker {
            // Version-matched to what Playwright needs, same convention
            // as the earlier playwright-pom-login-tests / robot-browser
            // Jenkins jobs.
            image 'mcr.microsoft.com/playwright:v1.62.1-jammy'
        }
    }

    environment {
        // Defaults already point at the live Render deployments inside
        // the spec file itself; left here for visibility only.
        // REDIS_BASE_URL   = 'https://redis-cache-mock-api.onrender.com'
        // INMEMORY_BASE_URL = 'https://inmemory-cache-mock-api.onrender.com'
        TEST_USER_ID = '2'
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {
        stage('Install dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Run Redis + in-memory cache tests') {
            steps {
                // ELK spec deliberately excluded: it needs a local
                // Elasticsearch + elk-cache-mock-api this Jenkins agent
                // has no access to. Only the two live-Render backends
                // run here, and workers are already pinned to 1 in
                // playwright.config.ts since both share one Postgres row.
                sh 'npx playwright test tests/redis-inmemory-cache.spec.ts'
            }
        }
    }

    post {
  pipeline {
    agent {
        docker {
            // Version-matched to what Playwright needs, same convention
            // as the earlier playwright-pom-login-tests / robot-browser
            // Jenkins jobs.
            image 'mcr.microsoft.com/playwright:v1.62.1-jammy'
        }
    }

    environment {
        // Defaults already point at the live Render deployments inside
        // the spec file itself; left here for visibility only.
        // REDIS_BASE_URL   = 'https://redis-cache-mock-api.onrender.com'
        // INMEMORY_BASE_URL = 'https://inmemory-cache-mock-api.onrender.com'
        TEST_USER_ID = '2'
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {
        stage('Install dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Run Redis + in-memory cache tests') {
            steps {
                // ELK spec deliberately excluded: it needs a local
                // Elasticsearch + elk-cache-mock-api this Jenkins agent
                // has no access to. Only the two live-Render backends
                // run here, and workers are already pinned to 1 in
                // playwright.config.ts since both share one Postgres row.
                sh 'npx playwright test tests/redis-inmemory-cache.spec.ts'
            }
        }
    }

    post {
        always {
            junit 'results.xml'
            publishHTML(target: [
                reportName: 'Playwright Report',
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                keepAll: true,
                alwaysLinkToLastBuild: true,
                allowMissing: false
            ])
        }
    }
}
      always {
            junit 'results.xml'
        }
    }
}
