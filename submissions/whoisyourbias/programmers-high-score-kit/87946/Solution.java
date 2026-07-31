class Solution {
	static int count;

	/*
	 * k는 1 이상 5,000 이하인 자연수입니다.
	 * dungeons의 세로(행) 길이(즉, 던전의 개수)는 1 이상 8 이하입니다.
	 * dungeons의 가로(열) 길이는 2 입니다.
	 * dungeons의 각 행은 각 던전의 ["최소 필요 피로도", "소모 피로도"] 입니다.
	 * "최소 필요 피로도"는 항상 "소모 피로도"보다 크거나 같습니다.
	 * "최소 필요 피로도"와 "소모 피로도"는 1 이상 1,000 이하인 자연수입니다.
	 * 서로 다른 던전의 ["최소 필요 피로도", "소모 피로도"]가 서로 같을 수 있습니다.
	 *
	 */
	public int solution(int k, int[][] dungeons) {
		count = 0;
		boolean[] visited = new boolean[dungeons.length];

		for (int i = 0; i < visited.length; i++) {
			if (k >= dungeons[i][0] && k - dungeons[i][1] >= 0) {
				visited[i] = true;
				// 변화
				k -= dungeons[i][1];
				dfs(visited, dungeons, k, 1);
				// 변화취소
				k += dungeons[i][1];
				visited[i] = false;
			}
		}

		return count;
	}

	public void dfs(boolean[] visited, int[][] dungeons, int k, int n) {
		if (n > count) {
			count = n;
		}

		for (int i = 0; i < dungeons.length; i++) {
			if (!visited[i]) {
				if (k >= dungeons[i][0] && k - dungeons[i][1] >= 0) {

					visited[i] = true;
					// 변화
					k -= dungeons[i][1];
					dfs(visited, dungeons, k, n + 1);
					// 변화취소
					k += dungeons[i][1];
					visited[i] = false;
				}
			}
		}
	}
}
