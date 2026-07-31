import java.util.ArrayList;
import java.util.HashSet;

class Solution {
	static HashSet<Integer> set;

    public int solution(String numbers) {
		set = new HashSet<>();
		int[] nums = new int[numbers.length()];
		boolean[] visited = new boolean[numbers.length()];
		ArrayList<Integer> arr = new ArrayList<>();

		for (int i = 0; i < nums.length; i++) {
			nums[i] = numbers.charAt(i) - '0';
		}

		for (int i = 1; i <= numbers.length(); i++) {
			permutation(arr , nums, visited, i, 0);
		}
        System.out.println(set);

		return set.size();
    }

	public void permutation(ArrayList<Integer> arr,int[] nums, boolean[] visited, int r, int c) {
        // System.out.println(arr);
		if (r == c) {
			String s = "";
			for (int i = 0; i < arr.size(); i++) {
				s = s.concat(arr.get(i).toString());
			}
			int intS = Integer.valueOf(s);
			if (isPrime(intS))
				set.add(intS);
			return;
		}
		for (int i = 0; i < nums.length; i++)
		{
			if (visited[i] == false) {
				visited[i] = true;
				arr.add(nums[i]);
				permutation(arr, nums, visited, r, c + 1);
				arr.removeLast();
				visited[i] = false;
			}
		}
	}

	public boolean isPrime(int n) {
        if (n == 1) return false;
        if (n == 2) return true;
		if (n%2 == 0) return false;

        // 제곱수까지 걸러야함 
		for (int i = 3; i*i <= n; i+=2) {
			if (n % i == 0) return false;
		}
		return true;
	}
}
