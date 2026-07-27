/*

작업의 개수(progresses, speeds배열의 길이)는 100개 이하입니다.
작업 진도는 100 미만의 자연수입니다.
작업 속도는 100 이하의 자연수입니다.
배포는 하루에 한 번만 할 수 있으며, 하루의 끝에 이루어진다고 가정합니다. 예를 들어 진도율이 95%인 작업의 개발 속도가 하루에 4%라면 배포는 2일 뒤에 이루어집니다.
 * */

import java.util.Map.Entry;
import java.util.TreeMap;

class Solution {
	public int[] solution(int[] progresses, int[] speeds) {
		int[] answer = {};

		TreeMap<Integer, Integer> m = new TreeMap<>();

		int curday = 1;
		for (int i = 0; i < progresses.length; i++) {
			while (progresses[i] + speeds[i] * curday < 100) {
				curday++;
			}

			m.put(curday, m.getOrDefault(curday, 0) + 1);
		}

		answer = new int[m.size()];
		int i = 0;
		for (Entry<Integer, Integer> e : m.entrySet()) {
			answer[i++] = e.getValue();
		}

		return answer;
	}
}
