FROM python:alpine
RUN apk --no-cache add curl

ARG KUBERNETES_VERSION

# Install kubectl
RUN curl -LO https://storage.googleapis.com/kubernetes-release/release/$(echo $KUBERNETES_VERSION)/bin/linux/amd64/kubectl \
	&& mv kubectl /usr/local/bin \
	&& chmod +x /usr/local/bin/kubectl

RUN adduser -S user
USER user
WORKDIR /home/user
ENV PATH /usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/user/.local/bin

# Install awscli
RUN pip install awscli --upgrade --user