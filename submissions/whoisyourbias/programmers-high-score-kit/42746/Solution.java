import java.util.Arrays;
import java.util.Comparator;

class Solution {
	public String solution(int[] numbers) {
		String answer = "";

		String[] arr = new String[numbers.length];

		for (int i = 0; i < numbers.length; i++) {
			arr[i] = String.valueOf(numbers[i]);
		}

		Arrays.sort(arr, new Comparator<String>() {
			@Override
			public int compare(String a, String b) {
				return (b + a).compareTo(a + b);
			}
		});

		answer = String.join("", arr);

		if (answer.charAt(0) == '0') {
			return "0";
		}
		return answer;
	}
}
