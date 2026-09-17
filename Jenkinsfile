pipeline {
    agent {
        docker {
            image 'mcr.microsoft.com/playwright:v1.62.1-jammy'
        }
    }

    environment {
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