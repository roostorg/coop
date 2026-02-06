from __future__ import print_function
import json
import boto3
import os
import urllib3

codepipeline_client = boto3.client('codepipeline')
access_token = os.environ['GITHUB_ACCESS_TOKEN']
region = os.environ['AWS_REGION']


def pipeline_status_changed_handler(event, context):
    """
    Notify github when a pipeline's status changes.
    """
    message = event['Records'][0]['Sns']['Message']
    data = json.loads(message)
    print(data)

    # We only know how to handle/want to push notifications about Pipeline
    # Execution State Changes (i.e., pipeline started, finished, failed, etc)
    # and for limited Action Execution State Changes -- namely, the one that
    # happen when the "Wait for manual approval" action starts or is acted on.
    is_pipeline_status_change_event = (
        data.get("detailType") == "CodePipeline Pipeline Execution State Change"
    )

    is_manual_approval_status_change_event = (
        data.get("detailType") == "CodePipeline Action Execution State Change" and (
            data['detail']['type']['provider'] == 'Manual' and (
                data['detail']['type']['category'] == 'Approval'
            )
        )
    )

    if not is_pipeline_status_change_event and not is_manual_approval_status_change_event:
        return()

    pipeline_name = data['detail']['pipeline']
    pipeline_execution_id = data['detail']['execution-id']
    repo_id, commit_id = commit_from_pipeline_execution(
        pipeline_name,
        pipeline_execution_id
    )

    normalized_state = data['detail']['state'].upper()
    is_awaiting_manual_approval = (
        is_manual_approval_status_change_event and normalized_state == "STARTED")

    # If this is the manual approval event, then that event "starting" means
    # that the prior events completed successfully, so we want to show the
    # pipeline as "succeeded", even though there are more steps to run after
    # approval. Meanwhile, that event completing means the pipeline's running again.
    if is_manual_approval_status_change_event:
        if normalized_state == "STARTED":
            state = "success"
        elif normalized_state == "SUCCEEDED":
            state = "pending"
        else:
            state = "error"
    else:
        if normalized_state in ["SUCCEEDED"]:
            state = "success"
        elif normalized_state in ["STARTED", "STOPPING", "STOPPED", "SUPERSEDED", "RESUMED"]:
            state = "pending"
        else:
            state = "error"

    r = urllib3.PoolManager().request(
        'POST',
        "https://api.github.com/repos/" + repo_id + "/statuses/" + commit_id,
        headers={
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Curl/0.1',
            'Authorization': 'token %s' % access_token},
        body=json.dumps({
            "state": state,
            "context": "CodePipeline",
            "description": pipeline_name + (" is awaiting manual approval" if is_awaiting_manual_approval else ""),
            'target_url': "https://" + region + ".console.aws.amazon.com/codesuite/codepipeline/pipelines/" + pipeline_name + "/executions/" + pipeline_execution_id + "?region="+region
        }).encode('utf-8')
    )

    print(r.data)

    return message


def commit_from_pipeline_execution(pipeline_name, pipeline_execution_id):
    response = codepipeline_client.get_pipeline_execution(
        pipelineName=pipeline_name,
        pipelineExecutionId=pipeline_execution_id
    )

    commit_id = response['pipelineExecution']['artifactRevisions'][0]['revisionId']
    revision_url = response['pipelineExecution']['artifactRevisions'][0]['revisionUrl']
    repo_id = repo_id_from_pipeline_artifact_revision_url(revision_url)

    return (repo_id, commit_id)


def repo_id_from_pipeline_artifact_revision_url(revision_url):
    if "FullRepositoryId=" in revision_url:
        return revision_url.split("FullRepositoryId=")[1].split("&")[0]
    else:  # gitbub v1 integration
        return revision_url.split("/")[3] + "/" + revision_url.split("/")[4]
