import java.util.*;

class Solution {
	class BFSSTATUS {
		boolean[] visited;
		int step;
		String s;

		BFSSTATUS(boolean[] visited, int step, String s) {
			this.visited=  visited;
			this.step = step;
			this.s = s;
		}
        
        @Override
		public String toString() {
			return s + " step:" + step;
		}

	}

	static int answer;

    public int solution(String begin, String target, String[] words) {
		answer = Integer.MAX_VALUE;

		boolean[] visited = new boolean[words.length];

		LinkedList<BFSSTATUS> lst = new LinkedList<>();

		for (int i = 0; i < words.length; i++) {
			if (findWordDiffer(begin, words[i]) == 1) {
				visited[i] = true;
				lst.add(new BFSSTATUS(visited.clone(), 1, words[i]));
				visited[i] = false;
			}
		}

		while (!lst.isEmpty()) {
			BFSSTATUS bs = lst.pollFirst();
            // System.out.println(bs);
			bfs(bs, lst, target, words);
		}

        if (answer == Integer.MAX_VALUE)
            return 0;
        return answer;
    }

	public void bfs(BFSSTATUS bs, LinkedList<BFSSTATUS> lst, String target, String[] words) {
		if (bs.s.equals(target)) {
            if (bs.step < answer)
    			answer = bs.step;
			return;
		}

		for (int i = 0; i < words.length; i++) {
			if (bs.visited[i] == true)
				continue;

			if (findWordDiffer(bs.s, words[i]) == 1) {
				boolean[] v = bs.visited.clone();
				v[i] = true;
				BFSSTATUS newOne = new BFSSTATUS(v, bs.step + 1, words[i]);
				lst.add(newOne);
			}
		}


	}

	public int findWordDiffer(String s1, String s2) {
		int sum = 0;

		for (int i = 0; i < s1.length(); i++){
			if (s1.charAt(i) != s2.charAt(i))
                sum++;
		}
        // System.out.println(sum + " " + s1 + "-" + s2);
		return sum;
	}
}
