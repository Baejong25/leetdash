import java.util.ArrayList;

public class Solution {
	public int[] solution(int[] arr) {
		int[] answer = {};
		ArrayList<Integer> a = new ArrayList<>();

		for (int i = 0; i < arr.length; i++) {
			if (i >= 1 && arr[i - 1] == arr[i])
				continue;
			a.add(arr[i]);
		}

		answer = new int[a.size()];
		for (int i = 0; i < a.size(); i++) {
			answer[i] = a.get(i);
		}

		return answer;
	}
}
