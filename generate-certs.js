import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// Create certs directory if it doesn't exist
const certsDir = join(process.cwd(), 'certs')
if (!existsSync(certsDir)) {
  mkdirSync(certsDir)
}

console.log('Generating self-signed certificates...')

try {
  // Generate private key
  execSync(`openssl genrsa -out ${join(certsDir, 'localhost-key.pem')} 2048`, { stdio: 'inherit' })

  // Generate certificate
  execSync(`openssl req -new -x509 -key ${join(certsDir, 'localhost-key.pem')} -out ${join(certsDir, 'localhost.pem')} -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`, { stdio: 'inherit' })

  console.log('✅ Certificates generated successfully!')
  console.log('You can now run: npm run dev')
} catch (error) {
  console.error('❌ Error generating certificates:', error.message)
  console.log('Make sure OpenSSL is installed on your system')
}