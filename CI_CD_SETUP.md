# CI/CD Setup Guide - GitHub Actions

This guide explains how to set up and use the GitHub Actions workflow for deploying the URSB Asset Management System to your VM.

## Overview

The GitHub Actions workflow allows you to:
- **Select any branch** to deploy (main, develop, staging, or custom)
- **Choose deployment environment** (production or staging)
- **Automatically deploy** to your VM via SSH
- **Run database migrations** automatically
- **Perform health checks** after deployment

## Prerequisites

- GitHub repository with the project code
- VM accessible via SSH (192.168.8.82)
- Docker and Docker Compose installed on the VM
- GitHub account with repository access

## Setup Instructions

### 1. Generate SSH Key Pair

On your local machine, generate an SSH key pair for deployment:

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/github_deploy_key
```

This creates:
- Private key: `~/.ssh/github_deploy_key`
- Public key: `~/.ssh/github_deploy_key.pub`

### 2. Add Public Key to VM

Copy the public key to your VM:

```bash
ssh-copy-id -i ~/.ssh/github_deploy_key.pub user@192.168.8.82
```

Or manually add it:

```bash
cat ~/.ssh/github_deploy_key.pub | ssh user@192.168.8.82 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 3. Configure GitHub Secrets

Go to your GitHub repository: **Settings → Secrets and variables → Actions**

Add the following secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SSH_PRIVATE_KEY` | Private SSH key content | Content of `~/.ssh/github_deploy_key` |
| `VM_IP` | VM IP address | `192.168.8.82` |
| `VM_USER` | VM username | `ubuntu` or your username |
| `DEPLOY_PATH` | Path to project on VM | `/home/user/ursb_asset_mgt` |

**Important:** When adding `SSH_PRIVATE_KEY`, copy the entire content of the private key file including the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines.

### 4. Verify SSH Access

Test SSH connection from GitHub Actions runner (optional):

```bash
ssh -i ~/.ssh/github_deploy_key user@192.168.8.82
```

## Using the Workflow

### Manual Deployment

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Deploy to Production VM** workflow
4. Click **Run workflow**
5. Choose:
   - **Branch**: main, develop, staging, or any other branch
   - **Environment**: production or staging
6. Click **Run workflow**

### Workflow Steps

The workflow performs these steps:

1. **Checkout code** from the selected branch
2. **Set up Docker Buildx** for building images
3. **Configure SSH** using the private key
4. **Copy files** to VM (excluding node_modules, venv, etc.)
5. **Deploy** on VM:
   - Stop existing containers
   - Build and start new containers
   - Check container status
6. **Run database migrations**
7. **Health check** to verify deployment
8. **Cleanup** SSH key

## Customizing Branch Options

To add more branch options, edit `.github/workflows/deploy.yml`:

```yaml
inputs:
  branch:
    type: choice
    options:
      - main
      - develop
      - staging
      - feature/new-feature  # Add your custom branch
```

## Troubleshooting

### SSH Connection Failed

- Verify `SSH_PRIVATE_KEY` secret is correct
- Check that public key is added to VM's `authorized_keys`
- Ensure VM is accessible and SSH service is running
- Check VM firewall allows SSH connections

### Permission Denied

- Verify `VM_USER` has proper permissions on `DEPLOY_PATH`
- Ensure user can run Docker commands without sudo
- Check file permissions on the VM

### Docker Build Failed

- Check Docker logs on VM: `docker-compose logs`
- Verify Docker and Docker Compose are installed
- Ensure sufficient disk space on VM

### Health Check Failed

- Check if containers are running: `docker-compose ps`
- Verify backend is accessible: `curl http://192.168.8.82/health`
- Check application logs: `docker-compose logs backend`

### Branch Not Found

- Ensure the branch exists in your repository
- Check branch name spelling (case-sensitive)
- Verify workflow has access to the branch

## Security Best Practices

1. **Use dedicated SSH key** for GitHub Actions (not your personal key)
2. **Restrict SSH key permissions** on the VM
3. **Rotate SSH keys** periodically
4. **Use GitHub Environments** for approval workflows
5. **Monitor deployment logs** for suspicious activity
6. **Keep secrets updated** when credentials change

## Advanced Configuration

### Automatic Deployment on Push

To automatically deploy when pushing to main branch, add this to the workflow:

```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:
    # ... existing inputs
```

### Environment-Specific Configuration

Create different docker-compose files for different environments:

```yaml
- name: Deploy on VM
  run: |
    ssh -i ~/.ssh/deploy_key ${{ secrets.VM_USER }}@${{ secrets.VM_IP }} \
      "cd ${{ secrets.DEPLOY_PATH }} && \
       docker-compose -f docker-compose.${{ github.event.inputs.environment }}.yml up -d --build"
```

### Slack Notifications

Add Slack notifications for deployment status:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Monitoring Deployments

- View workflow runs in GitHub Actions tab
- Check real-time logs during deployment
- Monitor VM resources after deployment
- Set up alerts for failed deployments

## Rollback Procedure

If a deployment fails:

1. **Stop the workflow** if still running
2. **SSH into VM** and check logs:
   ```bash
   ssh user@192.168.8.82
   cd ursb_asset_mgt
   docker-compose logs
   ```
3. **Rollback to previous version**:
   ```bash
   docker-compose down
   git checkout <previous-commit-hash>
   docker-compose up -d --build
   ```
4. **Or restore from backup** if database was affected

## Support

For issues:
- Check GitHub Actions logs
- Review VM logs: `docker-compose logs`
- Verify SSH connectivity
- Check GitHub Secrets configuration
