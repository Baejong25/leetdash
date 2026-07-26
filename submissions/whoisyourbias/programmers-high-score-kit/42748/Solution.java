/*
array의 길이는 1 이상 100 이하입니다.
array의 각 원소는 1 이상 100 이하입니다.
commands의 길이는 1 이상 50 이하입니다.
commands의 각 원소는 길이가 3입니다.
 * */

import java.util.Arrays;

class Solution {
	public int[] solution(int[] array, int[][] commands) {
		int[] answer = new int[commands.length];

		int count = 0;

		for (int[] c : commands) {
			int i = c[0];
			int j = c[1];
			int k = c[2];

			answer[count++] = Arrays.stream(Arrays.copyOfRange(array, i - 1, j)).sorted().toArray()[k - 1];
		}

		return answer;
	}
}
